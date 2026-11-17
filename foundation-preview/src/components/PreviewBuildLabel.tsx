import { TEND_BUILD_ID } from '../build-info.ts';

export function PreviewBuildLabel({ className = '' }: { className?: string }) {
  const classes = ['preview-build-label', className].filter(Boolean).join(' ');
  return <p className={classes}>Build {TEND_BUILD_ID}</p>;
}
