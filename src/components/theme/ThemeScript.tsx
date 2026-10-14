/**
 * Applies the saved theme before first paint so there is no flash.
 * Default is dark: StoryForge is an observatory, the page itself stays warm.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("sf:theme");if(!t){t="dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
