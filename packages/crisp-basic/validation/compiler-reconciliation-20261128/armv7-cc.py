#!/usr/bin/env python3
import os, sys
root='/workspace/scratch/3cdb117b9e13/toolchains/root'
os.environ['LD_LIBRARY_PATH']=root+'/usr/lib/x86_64-linux-gnu'
os.execv(root+'/usr/bin/arm-linux-gnueabihf-gcc', [root+'/usr/bin/arm-linux-gnueabihf-gcc','--sysroot='+root,*sys.argv[1:]])
