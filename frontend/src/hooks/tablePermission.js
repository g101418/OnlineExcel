// 权限设置字典
export const permissionDict = {
  // 行权限
  rowPermissions: {
    editable: false, // 默认不可编辑
    deletable: false, // 默认不可删除
    selectable: true // 默认可选择
  },
  // 单元格权限
  cellPermissions: {
    editable: false, // 默认不可编辑
    copyable: true // 默认可复制
  },
  // 默认列权限
  defaultColumnPermissions: {
    editable: false,
    validation: {
      type: '',
      min: null,
      max: null,
      maxLength: null,
      options: ''
    }
  }
};

// 为特定表格应用权限设置
export const applyPermissionsToTable = (tableData, columns, permissions) => {
  // 应用行权限
  const rowsWithPermissions = tableData.map(row => ({
    ...row,
    _permissions: {
      ...permissions.row
    }
  }));
  
  // 应用列权限
  const columnsWithPermissions = columns.map(col => {
    const existingColPermission = permissions.columns.find(p => p.label === col);
    return {
      label: col,
      prop: col,
      ...permissionDict.defaultColumnPermissions,
      ...existingColPermission
    };
  });
  
  return {
    data: rowsWithPermissions,
    columns: columnsWithPermissions
  };
};

// 获取默认权限设置
export const getDefaultPermissions = () => {
  return {
    row: {
      ...permissionDict.rowPermissions
    },
    cell: {
      ...permissionDict.cellPermissions
    },
    columns: []
  };
};