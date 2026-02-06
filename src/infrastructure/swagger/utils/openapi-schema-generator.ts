import { mapColumnTypeToOpenAPI } from './openapi-type-mapper';
interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: any[];
  $ref?: string;
  [key: string]: any;
}
export function generateSchemasFromTables(tables: any[]): Record<string, SchemaObject> {
  const schemas: Record<string, SchemaObject> = {};
  for (const table of tables) {
    if (!table?.name) continue;
    const tableName = table.name;
    schemas[tableName] = generateTableSchema(table, false);
    schemas[`${tableName}Input`] = generateTableSchema(table, true);
    schemas[`${tableName}Update`] = generateTableSchema(table, true, true);
  }
  schemas['PaginatedResponse'] = {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { type: 'object' }
      },
      meta: {
        type: 'object',
        properties: {
          totalCount: { type: 'integer' },
          filterCount: { type: 'integer' },
        }
      }
    }
  };
  return schemas;
}
function generateTableSchema(
  table: any,
  isInput: boolean = false,
  isUpdate: boolean = false
): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];
  for (const column of table.columns || []) {
    if (isInput && (column.isPrimary || column.name === 'createdAt' || column.name === 'updatedAt')) {
      continue;
    }
    const fieldName = column.name;
    const schema = mapColumnTypeToOpenAPI(column.type);
    if (column.type === 'enum' && column.options) {
      schema.enum = column.options;
    }
    properties[fieldName] = schema;
    if (!isUpdate && !column.isNullable && !column.isPrimary) {
      required.push(fieldName);
    }
  }
  if (isUpdate) {
    properties.id = { type: 'string' };
    required.push('id');
  }
  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
export function generateResponseSchema(tableName: string): SchemaObject {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {
          $ref: `#/components/schemas/${tableName}`
        }
      },
      meta: {
        type: 'object',
        properties: {
          totalCount: { type: 'integer' },
          filterCount: { type: 'integer' },
        }
      }
    }
  };
}
export function generateSingleItemSchema(tableName: string): SchemaObject {
  return {
    $ref: `#/components/schemas/${tableName}`
  };
}
export function generateErrorSchema(): SchemaObject {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string' },
      statusCode: { type: 'integer' },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          method: { type: 'string' },
          correlationId: { type: 'string' },
        }
      }
    }
  };
}