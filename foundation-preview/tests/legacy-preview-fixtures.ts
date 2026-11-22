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
  const { personSparks: _personSparks, ...legacyData } = data as TData & { personSparks?: unknown };
  return { ...envelope, schemaVersion, data: legacyData as TData };
}
