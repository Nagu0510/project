// THE one layout breakpoint. Mobile layout is "768px and below"; anything wider is desktop.
// The CSS in src/index.css uses the same literal 768px (media queries can't read variables):
// if you change this number, change every "768px" in index.css and Navbar.jsx too.
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;
export const SIDEBAR_WIDTH = 264;
