import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { BaseTableProcessor, UpsertResult } from './base-table-processor';
import { QueryBuilderService } from '../../../infrastructure/query-builder/query-builder.service';
import { ObjectId } from 'mongodb';
@Injectable()
export class MenuDefinitionProcessor extends BaseTableProcessor {
  constructor(private readonly queryBuilder: QueryBuilderService) {
    super();
  }
  async processSql(
    records: any[],
    knex: Knex,
    tableName: string,
    context?: any,
  ): Promise<UpsertResult> {
    const dropdownMenus = records.filter(r => r.type === 'Dropdown Menu');
    const menuItems = records.filter(r => r.type === 'Menu');
    let totalCreated = 0;
    let totalSkipped = 0;
    if (dropdownMenus.length > 0) {
      this.logger.log(`Processing ${dropdownMenus.length} Dropdown Menus...`);
      const result = await super.processSql(dropdownMenus, knex, tableName, { ...context, knex });
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    if (menuItems.length > 0) {
      this.logger.log(`Processing ${menuItems.length} Menu items...`);
      const result = await super.processSql(menuItems, knex, tableName, { ...context, knex });
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    return { created: totalCreated, skipped: totalSkipped };
  }
  async processMongo(
    records: any[],
    db: any,
    collectionName: string,
    context?: any,
  ): Promise<UpsertResult> {
    if (!records || records.length === 0) {
      return { created: 0, skipped: 0 };
    }
    const dropdownMenus = records.filter(r => r.type === 'Dropdown Menu');
    const menuItemsWithParent = records.filter(r => r.type === 'Menu' && r.parent);
    const otherMenuItems = records.filter(r => r.type === 'Menu' && !r.parent);
    let totalCreated = 0;
    let totalSkipped = 0;
    if (dropdownMenus.length > 0) {
      this.logger.log(`Processing ${dropdownMenus.length} Dropdown Menus...`);
      const result = await super.processMongo(dropdownMenus, db, collectionName, context);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    if (otherMenuItems.length > 0) {
      this.logger.log(`Processing ${otherMenuItems.length} Menu items...`);
      const result = await super.processMongo(otherMenuItems, db, collectionName, context);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    if (menuItemsWithParent.length > 0) {
      this.logger.log(`Processing ${menuItemsWithParent.length} Menu items with parents...`);
      const result = await super.processMongo(menuItemsWithParent, db, collectionName, context);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    return { created: totalCreated, skipped: totalSkipped };
  }
  async transformRecords(records: any[], context?: any): Promise<any[]> {
    const isMongoDB = process.env.DB_TYPE === 'mongodb';
    const knex = context?.knex;
    if (!isMongoDB && !knex) {
      this.logger.warn('Knex not provided in context for SQL, returning records as-is');
      return records;
    }
    const transformedRecords = [];
    for (const record of records) {
      const transformed = { ...record };
      if (transformed.icon === undefined) transformed.icon = 'lucide:menu';
      if (transformed.isEnabled === undefined) transformed.isEnabled = true;
      if (transformed.isSystem === undefined) transformed.isSystem = false;
      if (transformed.order === undefined) transformed.order = 0;
      if (isMongoDB) {
        const now = new Date();
        if (!transformed.createdAt) transformed.createdAt = now;
        if (!transformed.updatedAt) transformed.updatedAt = now;
      }
      if (isMongoDB) {
        if (!('parent' in transformed)) transformed.parent = null;
      }
      if (transformed.parent && typeof transformed.parent === 'string') {
        const parentLabel = transformed.parent;
        if (isMongoDB) {
          const parent = await this.queryBuilder.findOneWhere('menu_definition', {
            type: 'Dropdown Menu',
            label: parentLabel,
          });
          if (parent) {
            this.logger.debug(`Found parent: ${parentLabel} with id ${parent._id}`);
            transformed.parent = typeof parent._id === 'string'
              ? new ObjectId(parent._id)
              : parent._id;
          } else {
            this.logger.warn(`Parent not found: ${parentLabel} for ${transformed.label}`);
            transformed.parent = null;
          }
        } else {
          const parent = await knex('menu_definition')
            .where({ type: 'Dropdown Menu', label: parentLabel })
            .first();
          if (parent) {
            this.logger.debug(`Found parent: ${parentLabel} with id ${parent.id}`);
            transformed.parentId = parent.id;
            delete transformed.parent;
          } else {
            this.logger.warn(`Parent not found: ${parentLabel} for ${transformed.label}`);
            delete transformed.parent;
          }
        }
      }
      transformedRecords.push(transformed);
    }
    return transformedRecords;
  }
  getUniqueIdentifier(record: any): object[] {
    const conditions = [];
    if (record.path) {
      conditions.push({ path: record.path });
    }
    conditions.push({ type: record.type, label: record.label });
    if (record.parent) {
      conditions.push({ type: record.type, label: record.label, parent: record.parent });
    }
    return conditions;
  }
  protected getCompareFields(): string[] {
    const isMongoDB = process.env.DB_TYPE === 'mongodb';
    const parentField = isMongoDB ? 'parent' : 'parentId';
    return ['type', 'label', 'icon', 'path', 'isEnabled', 'description', 'order', 'permission', parentField];
  }
  protected hasValueChanged(newValue: any, existingValue: any): boolean {
    if (typeof newValue === 'object' && newValue?.id && typeof existingValue === 'object' && existingValue?.id) {
      return newValue.id !== existingValue.id;
    }
    if ((newValue === null || newValue === undefined) && (existingValue && typeof existingValue === 'object' && existingValue.id)) {
      return true;
    }
    if ((existingValue === null || existingValue === undefined) && (newValue && typeof newValue === 'object' && newValue.id)) {
      return true;
    }
    return super.hasValueChanged(newValue, existingValue);
  }
  protected getRecordIdentifier(record: any): string {
    const type = record.type;
    const label = record.label;
    const parent = record.parent;
    if (type === 'Dropdown Menu') {
      return `[Dropdown Menu] ${label}`;
    } else if (type === 'Menu' || type === 'menu') {
      return `[Menu] ${label}${parent ? ` (parent: ${parent})` : ''} -> ${record.path || 'no-path'}`;
    }
    return `[${type}] ${label}`;
  }
}