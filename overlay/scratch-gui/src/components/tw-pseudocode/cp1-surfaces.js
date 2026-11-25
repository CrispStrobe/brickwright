// SPDX-License-Identifier: BSD-3-Clause
import {createContext} from 'react';

// The debugger owns the CP1 panel and runner. The two other panes supply
// destinations for views of that same panel.
export const Cp1Surfaces = createContext(null);
