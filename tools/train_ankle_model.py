"""Reproduce the public MHEALTH ankle baseline, split strictly by participant."""
import argparse
import hashlib
import json
from pathlib import Path
import time
from zipfile import ZipFile

import numpy as np
import requests
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

from ankle_classifier import DEFAULT_MODEL, FEATURE_VERSION, LABELS, WINDOW, features

SOURCE = 'https://archive.ics.uci.edu/static/public/319/mhealth+dataset.zip'
PAGE = 'https://archive.ics.uci.edu/dataset/319/mhealth+dataset'
MAPPING = {1: 0, 2: 0, 3: 0, 4: 1, 10: 2, 11: 3, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 12: 4}


def download(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.partial')
    print('Downloading official MHEALTH archive (~72 MB)...', flush=True)
    with requests.get(SOURCE, stream=True, timeout=(15, 30)) as response, temporary.open('wb') as target:
        response.raise_for_status()
        total = 0;last_progress = time.monotonic()
        for chunk in response.iter_content(65536):
            target.write(chunk);total += len(chunk)
            if time.monotonic()-last_progress >= 10:
                print(f'Downloaded {total/1024/1024:.1f} MiB', flush=True);last_progress=time.monotonic()
    with ZipFile(temporary) as archive:
        if len([name for name in archive.namelist() if 'mHealth_subject' in name and name.endswith('.log')]) != 10:
            raise ValueError('Expected ten official participant logs')
    temporary.replace(path)


def dataset(path):
    all_x, all_y, groups = [], [], []
    with ZipFile(path) as archive:
        for participant in range(1, 11):
            member = next(name for name in archive.namelist() if name.endswith(f'mHealth_subject{participant}.log'))
            with archive.open(member) as stream:
                # Official columns 6..8 = ankle acceleration in m/s^2; last = activity label.
                data = np.loadtxt(stream, usecols=(5, 6, 7, 23))
            count = 0
            for start in range(0, len(data)-WINDOW+1, 25):
                window = data[start:start+WINDOW]
                label = int(window[0, 3])
                # Reject transitions, null labels, or any mixed-label window.
                if label not in MAPPING or not np.all(window[:, 3] == label) or not np.isfinite(window).all():
                    continue
                all_x.append(features(window[:, :3]/9.80665))
                all_y.append(MAPPING[label]);groups.append(participant);count += 1
            print(f'Participant {participant}: {count} pure 2-second windows', flush=True)
    return np.asarray(all_x), np.asarray(all_y), np.asarray(groups)


def metrics(model, x, y, threshold=.65, margin=.10):
    scores = model.predict_proba(x)
    prediction = scores.argmax(axis=1)
    ordered = np.sort(scores, axis=1)
    accepted = (ordered[:, -1] >= threshold) & (ordered[:, -1]-ordered[:, -2] >= margin)
    nonrun = ~np.isin(y, (2, 3))
    false_run = nonrun & np.isin(prediction, (2, 3)) & accepted
    return {
        'windows': len(y), 'accuracy': float(accuracy_score(y, prediction)),
        'macro_f1': float(f1_score(y, prediction, average='macro')),
        'coverage': float(accepted.mean()),
        'accepted_accuracy': float(accuracy_score(y[accepted], prediction[accepted])) if accepted.any() else None,
        'nonrunning_false_running_rate': float(false_run.sum()/max(1, nonrun.sum())),
        'confusion_matrix': confusion_matrix(y, prediction, labels=range(5)).tolist(),
        'classification_report': classification_report(y, prediction, labels=range(5), target_names=LABELS, output_dict=True, zero_division=0),
    }


def export(model, path, metadata):
    left, right, feature, threshold, value, offsets = [], [], [], [], [], []
    for estimator in model.estimators_:
        tree = estimator.tree_;offset = len(left);offsets.append(offset)
        left.extend(np.where(tree.children_left == -1, -1, tree.children_left+offset))
        right.extend(np.where(tree.children_right == -1, -1, tree.children_right+offset))
        feature.extend(tree.feature);threshold.extend(tree.threshold)
        distribution = tree.value[:, 0, :]
        value.extend(distribution/np.maximum(distribution.sum(axis=1, keepdims=True), 1e-12))
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, left=np.array(left, dtype=np.int32), right=np.array(right, dtype=np.int32),
        feature=np.array(feature, dtype=np.int16), threshold=np.array(threshold, dtype=np.float64),
        value=np.array(value, dtype=np.float64), offsets=np.array(offsets, dtype=np.int32))
    metadata['model_sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    path.with_name('metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, default=Path('.hardware-runtime/datasets/mhealth.zip'))
    parser.add_argument('--output', type=Path, default=DEFAULT_MODEL)
    args = parser.parse_args()
    if not args.dataset.is_file():download(args.dataset)
    digest = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    cache = args.dataset.with_name('mhealth-features-v1.npz')
    if cache.is_file():
        with np.load(cache, allow_pickle=False) as values:
            if str(values['sha']) != digest:raise ValueError('Dataset cache checksum mismatch')
            x, y, groups = values['x'], values['y'], values['groups']
    else:
        x, y, groups = dataset(args.dataset)
        np.savez_compressed(cache, x=x, y=y, groups=groups, sha=digest)
    train = groups <= 6;validation = np.isin(groups, (7, 8));test = groups >= 9
    print('Fitting fixed baseline on participants 1-6; validation 7-8; untouched test 9-10.', flush=True)
    model = RandomForestClassifier(n_estimators=128, max_depth=14, min_samples_leaf=3,
        class_weight='balanced_subsample', n_jobs=2, random_state=20261124)
    started = time.monotonic();model.fit(x[train], y[train])
    metadata = {'model_id': 'mhealth-ankle-rf-v1', 'feature_version': FEATURE_VERSION,
        'labels': list(LABELS), 'source': PAGE, 'download': SOURCE, 'dataset_sha256': digest,
        'license': 'MHEALTH dataset: CC BY 4.0 (UCI)',
        'citation': 'Banos, O., Garcia, R., & Saez, A. (2014). MHEALTH. UCI. https://doi.org/10.24432/C5TW22',
        'input': {'position': 'left ankle', 'channels': 'acceleration XYZ only', 'unit': 'g', 'rate_hz': 50, 'window_ms': 2000, 'stride_ms': 500},
        'split': {'train': list(range(1, 7)), 'validation': [7, 8], 'test': [9, 10]},
        'algorithm': 'RandomForestClassifier, 128 trees, max_depth=14, min_samples_leaf=3, seed=20261124',
        'training_windows': int(train.sum()), 'training_seconds': round(time.monotonic()-started, 2),
        'rejection': {'minimum_score': .65, 'minimum_margin': .10, 'note': 'Forest scores are not calibrated probabilities or an OOD guarantee.'},
        'validation': metrics(model, x[validation], y[validation]), 'test': metrics(model, x[test], y[test]),
        'limits': ['No in-place jogging ground truth is asserted.', 'No XIAO or project recordings used for training.',
                   'Public-data validation does not establish accuracy on the deployed wearer/device.',
                   'The classifier observes activity; calibrated movement control stays independent.']}
    export(model, args.output, metadata)
    # Verify numeric export against sklearn on previously unseen participants.
    from ankle_classifier import ActivityModel
    runtime = ActivityModel(args.output)
    assert runtime.metadata['model_sha256'] == hashlib.sha256(args.output.read_bytes()).hexdigest()
    for vector in x[test][::max(1, int(test.sum())//40)]:
        exported = runtime.predict_features(vector)['scores']
        np.testing.assert_allclose([exported[label] for label in LABELS], model.predict_proba([vector])[0], atol=.000051)
    print(json.dumps({'model': str(args.output), 'validation': metadata['validation'], 'test': metadata['test']}, indent=2), flush=True)


if __name__ == '__main__':main()
