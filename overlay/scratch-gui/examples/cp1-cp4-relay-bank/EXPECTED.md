# CP4 relay bank

| Closed switches | Port 1 / cell inputs | Port 2 / display |
| --- | ---: | ---: |
| None | 255 | 0 |
| 1, 3, 5, 7 | 170 | 85 |
| 2, 4, 6, 8 | 85 | 170 |
| All eight | 0 | 255 |

During monitor startup all eight relay contacts close. Once the program runs, a closed request switch lights only its own lamp. A lit branch carries about 3 mA. These observations are taken after the relay contacts and their suppression capacitors settle.
