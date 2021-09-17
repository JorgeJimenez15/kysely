import { checkConstraintNode } from '../operation-node/check-constraint-node'
import {
  isOperationNodeSource,
  OperationNodeSource,
} from '../operation-node/operation-node-source'
import { referenceNode } from '../operation-node/reference-node'
import { OnDelete, referencesNode } from '../operation-node/references-node'
import { selectAllNode } from '../operation-node/select-all-node'
import { valueNode } from '../operation-node/value-node'
import { parseStringReference } from '../parser/reference-parser'
import { RawBuilder } from '../raw-builder/raw-builder'
import { PrimitiveValue } from '../util/object-utils'
import { preventAwait } from '../util/prevent-await'
import {
  columnDefinitionNode,
  ColumnDefinitionNode,
} from '../operation-node/column-definition-node'

export interface ColumnDefinitionBuilderInterface<R> {
  /**
   * Makes the column automatically incrementing.
   *
   * On some dialects this may change the column type as well. For example
   * on postgres this sets the column type to `serial` no matter what you
   * have specified before.
   */
  increments(): R

  /**
   * Makes the column the primary key.
   *
   * If you want to specify a composite primary key use the
   * {@link TableBuilder.addPrimaryKeyConstraint} method.
   */
  primaryKey(): R

  /**
   * Adds a foreign key constraint for the column.
   *
   * @example
   * ```ts
   * col.references('person.id')
   * ```
   */
  references(ref: string): R

  /**
   * Adds an `on delete` constraint for the foreign key column.
   */
  onDelete(onDelete: OnDelete): R

  /**
   * Adds a unique constraint for the column.
   */
  unique(): R

  /**
   * Adds a `not null` constraint for the column.
   */
  notNull(): R

  /**
   * Adds a default value constraint for the column.
   *
   * @example
   * ```ts
   * db.schema
   *   .createTable('pet')
   *   .addColumn('number_of_legs', 'integer', (col) => col.defaultTo(4))
   *   .execute()
   * ```
   */
  defaultTo(value: PrimitiveValue | RawBuilder<any>): R

  /**
   * Adds a check constraint for the column.
   *
   * @example
   * ```ts
   * db.schema
   *   .createTable('pet')
   *   .addColumn('number_of_legs', (col) => col.check('number_of_legs < 5', 'integer'))
   *   .execute()
   * ```
   */
  check(sql: string): R
}

export class ColumnDefinitionBuilder
  implements
    ColumnDefinitionBuilderInterface<ColumnDefinitionBuilder>,
    OperationNodeSource
{
  readonly #node: ColumnDefinitionNode

  constructor(node: ColumnDefinitionNode) {
    this.#node = node
  }

  increments(): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, { isAutoIncrementing: true })
    )
  }

  primaryKey(): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, { isPrimaryKey: true })
    )
  }

  references(ref: string): ColumnDefinitionBuilder {
    const references = parseStringReference(ref)

    if (!referenceNode.is(references) || selectAllNode.is(references.column)) {
      throw new Error(
        `invalid call references('${ref}'). The reference must have format table.column or schema.table.column`
      )
    }

    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, {
        references: referencesNode.create(references.table, [
          references.column,
        ]),
      })
    )
  }

  onDelete(onDelete: OnDelete): ColumnDefinitionBuilder {
    if (!this.#node.references) {
      throw new Error('on delete constraint can only be added for foreign keys')
    }

    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, {
        references: referencesNode.cloneWithOnDelete(
          this.#node.references,
          onDelete
        ),
      })
    )
  }

  unique(): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, { isUnique: true })
    )
  }

  notNull(): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, { isNullable: false })
    )
  }

  defaultTo(value: PrimitiveValue | RawBuilder<any>): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, {
        defaultTo: isOperationNodeSource(value)
          ? value.toOperationNode()
          : valueNode.createImmediate(value),
      })
    )
  }

  check(sql: string): ColumnDefinitionBuilder {
    return new ColumnDefinitionBuilder(
      columnDefinitionNode.cloneWith(this.#node, {
        check: checkConstraintNode.create(sql),
      })
    )
  }

  toOperationNode(): ColumnDefinitionNode {
    return this.#node
  }
}

preventAwait(
  ColumnDefinitionBuilder,
  "don't await ColumnBuilder instances directly."
)