interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: any[];
  [key: string]: any;
}
export function mapColumnTypeToOpenAPI(columnType: string): SchemaObject {
  const typeMap: Record<string, SchemaObject> = {
    varchar: { type: 'string' },
    char: { type: 'string' },
    text: { type: 'string' },
    int: { type: 'integer', format: 'int32' },
    integer: { type: 'integer', format: 'int32' },
    smallint: { type: 'integer', format: 'int32' },
    bigint: { type: 'integer', format: 'int64' },
    float: { type: 'number', format: 'float' },
    double: { type: 'number', format: 'double' },
    decimal: { type: 'number' },
    numeric: { type: 'number' },
    real: { type: 'number' },
    boolean: { type: 'boolean' },
    bool: { type: 'boolean' },
    date: { type: 'string', format: 'date' },
    datetime: { type: 'string', format: 'date-time' },
    timestamp: { type: 'string', format: 'date-time' },
    time: { type: 'string', format: 'time' },
    uuid: { type: 'string', format: 'uuid' },
    json: { type: 'object' },
    'simple-json': { type: 'object' },
    jsonb: { type: 'object' },
    enum: { type: 'string' },
  };
  return typeMap[columnType] || { type: 'string' };
}
export function isNumericType(columnType: string): boolean {
  const numericTypes = [
    'int', 'integer', 'smallint', 'bigint',
    'float', 'double', 'decimal', 'numeric', 'real'
  ];
  return numericTypes.includes(columnType);
}
export function isDateTimeType(columnType: string): boolean {
  const dateTimeTypes = ['date', 'datetime', 'timestamp', 'time'];
  return dateTimeTypes.includes(columnType);
}