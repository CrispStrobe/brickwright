#!/usr/bin/env python3
import os, pathlib, shlex, subprocess, sys
root='/workspace/scratch/3cdb117b9e13/toolchains/root'
args=sys.argv[1:]
r=subprocess.run(['/workspace/scratch/3cdb117b9e13/compiler-validation/armv7-cc',*args])
if r.returncode: sys.exit(r.returncode)
if '-o' in args and not any(flag in args for flag in ['-c','-S','-E','-fsyntax-only']):
    output=pathlib.Path(args[args.index('-o')+1])
    binary=output.with_name(output.name+'.armv7-elf')
    output.rename(binary)
    command=[root+'/usr/bin/qemu-arm','-cpu','cortex-a7','-L',root+'/usr/arm-linux-gnueabihf',str(binary.resolve())]
    output.write_text('#!/bin/sh\nexec '+shlex.join(command)+' "$@"\n')
    output.chmod(0o755)
