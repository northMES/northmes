// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import logo from './northmes-logo.svg';
import logoOnDark from './northmes-logo-on-dark.svg';

/**
 * The NorthMES logo, the Gantt mark and the name, 32 px tall in a top bar. It is one image named
 * NorthMES: the file with dark text shows in the light theme and the one with light text in the
 * dark theme. Its width and height keep it 32 px tall before the stylesheet applies (BO1).
 * index.html's boot page draws the same markup before any script runs. The files are copies of
 * docs/design/logo.
 */
export function ProductLogo() {
  return (
    <span role="img" aria-label="NorthMES" className="flex shrink-0">
      <img src={logo} alt="" width={108} height={32} className="h-8 w-auto dark:hidden" />
      <img
        src={logoOnDark}
        alt=""
        width={108}
        height={32}
        className="hidden h-8 w-auto dark:block"
      />
    </span>
  );
}
