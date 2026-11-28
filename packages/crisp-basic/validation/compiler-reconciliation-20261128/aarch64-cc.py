#!/usr/bin/env python3
import os, sys
root='/workspace/scratch/3cdb117b9e13/toolchains/root'
os.environ['LD_LIBRARY_PATH']=root+'/usr/lib/x86_64-linux-gnu'
os.execv(root+'/usr/bin/aarch64-linux-gnu-gcc', [root+'/usr/bin/aarch64-linux-gnu-gcc','--sysroot='+root,*sys.argv[1:]])
