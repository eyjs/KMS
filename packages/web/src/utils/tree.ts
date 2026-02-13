/**
 * 트리 변환 유틸리티
 * Element Plus 컴포넌트(el-tree-select, el-cascader 등)용 트리 데이터 변환
 */

import type { DomainMasterEntity, DomainCategoryEntity } from '@kms/shared'

/** Element Plus 트리 컴포넌트용 옵션 타입 */
export interface TreeOption {
  label: string
  value: string | number
  children?: TreeOption[]
}

/**
 * 도메인 트리를 Element Plus el-tree-select용 옵션으로 변환합니다.
 * @param domains - 도메인 트리 배열
 * @returns el-tree-select용 옵션 배열
 */
export function buildDomainTreeOptions(domains: DomainMasterEntity[]): TreeOption[] {
  return domains.map((d) => ({
    label: d.displayName,
    value: d.code,
    children: d.children?.length ? buildDomainTreeOptions(d.children) : undefined,
  }))
}

/**
 * 트리 구조를 플랫 배열로 변환합니다.
 * @param categories - 카테고리 트리 배열
 * @returns 플랫 배열
 */
export function flattenCategoryTree(categories: DomainCategoryEntity[]): DomainCategoryEntity[] {
  const result: DomainCategoryEntity[] = []
  function traverse(items: DomainCategoryEntity[]) {
    for (const cat of items) {
      result.push(cat)
      if (cat.children?.length) {
        traverse(cat.children)
      }
    }
  }
  traverse(categories)
  return result
}
