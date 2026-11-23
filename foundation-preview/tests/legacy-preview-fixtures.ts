export function withPreSparkSchema<
  TEnvelope extends {
    schemaVersion: number;
    data: object;
  },
  TData extends object = TEnvelope['data']
>(
  envelope: TEnvelope,
  schemaVersion: number,
  data: TData = envelope.data as TData
): Omit<TEnvelope, 'schemaVersion' | 'data'> & {
  schemaVersion: number;
  data: TData;
} {
  const legacyData = { ...data } as TData & { personSparks?: unknown; peopleGroups?: unknown };
  if (schemaVersion < 51) delete legacyData.personSparks;
  if (schemaVersion < 54 && Array.isArray(legacyData.peopleGroups)) {
    legacyData.peopleGroups = legacyData.peopleGroups.filter(group =>
      typeof group !== 'object' || group === null || !('id' in group) || group.id !== 'dating'
    );
  }
  return { ...envelope, schemaVersion, data: legacyData as TData };
}
