import connectionSvg from '../assets/tend-approved-icons/foundations/connection.svg?raw';

const svgStart = connectionSvg.indexOf('>');
const svgEnd = connectionSvg.lastIndexOf('</svg>');
if (!connectionSvg.trimStart().startsWith('<svg ')
  || svgStart < 0
  || svgEnd <= svgStart) {
  throw new Error('The approved Connection foundation icon is not valid SVG markup.');
}
const connectionSvgContent = connectionSvg.slice(svgStart + 1, svgEnd);

export function PersonLinkIcon() {
  return (
    <svg
      className="person-link-icon"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: connectionSvgContent }}
    />
  );
}
