"""Validated, compact game-to-screen state. No user text or credentials."""
import struct

SCREEN_UUID = 'b1730004-2a7d-4e51-913c-4f79b150cc01'
STAGES = {name: i for i, name in enumerate(('idle','map','chop','wok','serve','win','fail','pause','flip'))}
THEMES = {name: i for i, name in enumerate(('neon','fridge','toilet','coffee'))}
FRAME = struct.Struct('<10B H h H I')


def encode_screen(value):
    if not isinstance(value, dict) or value.get('stage') not in STAGES or value.get('theme') not in THEMES:
        raise ValueError('Invalid screen state')
    def integer(key, low, high, default=0):
        n=value.get(key, default)
        if type(n) is not int or not low<=n<=high:
            raise ValueError('Invalid screen field: '+key)
        return n
    dish=integer('dish',0,5)
    progress=integer('progress',0,100)
    integrity=integer('integrity',0,100,100)
    cuts=integer('cuts',0,10);flips=integer('flips',0,2)
    flags=integer('flags',0,3);effect=integer('event',0,3)
    counter=integer('event_counter',0,65535)
    tilt=integer('tilt',-1000,1000)
    seconds=integer('seconds',0,65535)
    session=integer('session',1,0xffffffff)
    return FRAME.pack(1,STAGES[value['stage']],THEMES[value['theme']],dish,progress,integrity,
                      cuts,flips,flags,effect,counter,tilt,seconds,session)
