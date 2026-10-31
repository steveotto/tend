export function historyButtonName(expectedName: string) {
  return (accessibleName: string) =>
    accessibleName === expectedName || accessibleName.startsWith(`${expectedName}, Health `);
}
