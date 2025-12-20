// 权限设置字典
export const permissionDict = {
  // 行权限
  rowPermissions: {
    deletable: false, // 默认不可删除
    addable: true, // 默认允许新增行
    sortable: false // 默认不允许调整行顺序
  },
  // 默认列权限
  defaultColumnPermissions: {
    editable: false,
    required: false, // 是否必填
    validation: {
      type: '',
      min: null,
      max: null,
      maxLength: null,
      options: '',
      isInteger: false, // 是否为整数
      regex: '', // 自定义正则表达式
      regexName: '', // 正则表达式名称（如手机号、身份证号等）
      format: 'yyyy-mm-dd' // 日期格式，默认为yyyy-mm-dd
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
    columns: []
  };
};

export const getEmptyValidation = () => ({
  type: "",
  min: null,
  max: null,
  maxLength: null,
  options: [],
  isInteger: false,
  regex: "",
  regexName: "",
  format: ""
});