REM This example deliberately fails to demonstrate a source-mapped BASIC error.
PRINT "The next statement raises a division-by-zero error."
zero% = 0
PRINT 1 / zero%
END
