import React, { useState } from 'react';
import { defaultParams, PUBLIC_API_BASE_URL } from "@/constants/constant.ts";
import {
  Input,
  Select,
  Table,
  Modal,
  Button,
  Form,
  Tag,
  Popconfirm,
  notification,
  Space,
} from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { useDepartments } from '../ticket/useDeparments.ts';
import { ManagementLayout } from '@/layouts/ManagementLayout.tsx';
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";
import { logger } from '@/utils/logger.ts';

// ============================================
// SECTION 1: INTERFACES
// ============================================
interface Account {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  department_id?: string;
  department_name?: string;
  created_at: string;
  delete_at?: string;
}

interface CreateAccountRequest {
  username: string;
  password: string;
  email: string;
  role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  department_id?: string;
}

interface UpdateAccountRequest {
  username?: string;
  password?: string;
  email?: string;
  role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  department_id?: string;
}

interface AccountSearchParams {
  page: number;
  page_size: number;
  role?: string;
  department_name?: string;
}

// --- [NEW] Department Interfaces ---
interface Department {
  id: string;
  name: string;
}

interface CreateDepartmentRequest {
  name: string;
}

interface UpdateDepartmentRequest {
  name: string;
}

// ============================================
// SECTION 2: API SERVICE FUNCTIONS
// ============================================
async function fetchAccounts(params: AccountSearchParams) {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
  });

  const response = await fetch(
    `${PUBLIC_API_BASE_URL}/auth/account?${queryParams.toString()}`
  );
  if (!response.ok) throw new Error("Lỗi khi tải dữ liệu");

  const data = await response.json();
  return data;
}

async function createAccount(data: CreateAccountRequest) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/sign-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) throw new Error(result.message || "Lỗi khi tạo tài khoản");

  return result;
}

async function updateAccount(props: { id: string; data: UpdateAccountRequest }) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/account/${props.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(props.data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Lỗi khi cập nhật tài khoản");
  }

  return result;
}

async function deleteAccount(id: string) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/account/${id}`, {
    method: 'DELETE',
  });

  const result = await response.json();

  if (!response.ok) throw new Error(result.message || "Lỗi khi xóa tài khoản");

  return result;
}

// --- [NEW] Department API Functions ---
async function createDepartment(data: CreateDepartmentRequest) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/departments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Lỗi khi tạo phòng ban");
  return response.json();
}

async function updateDepartment(id: string, data: UpdateDepartmentRequest) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/departments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Lỗi khi cập nhật phòng ban");
  return response.json();
}

async function deleteDepartment(id: string) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/departments/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error("Lỗi khi xóa phòng ban");
  return response.json();
}

// ============================================
// SECTION 3: REACT QUERY HOOKS
// ============================================
function useAccounts(params: AccountSearchParams) {
  return useQuery(
    {
      queryKey: ["accounts", params],
      queryFn: () => fetchAccounts(params),
    },
    queryClient
  );
}

function useCreateAccount() {
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      notification.success({
        message: 'Thành công',
        description: 'Tài khoản đã được tạo thành công!',
      });
    },
    onError: (error: any) => {
      notification.error({
        message: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi tạo tài khoản',
      });
    },
  }, queryClient);
}

function useUpdateAccount() {
  return useMutation({
    mutationFn: updateAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      notification.success({
        message: 'Thành công',
        description: 'Tài khoản đã được cập nhật!',
      });
    },
    onError: (error: any) => {
      notification.error({
        message: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi cập nhật tài khoản',
      });
    },
  }, queryClient);
}

function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      notification.success({
        message: 'Thành công',
        description: 'Tài khoản đã được xóa!',
      });
    },
    onError: (error: any) => {
      notification.error({
        message: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi xóa tài khoản',
      });
    },
  }, queryClient);
}

// --- [NEW] Department React Query Hooks ---
function useCreateDepartment() {
  return useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({ message: 'Thành công', description: 'Phòng ban đã được tạo!' });
    },
    onError: (error: any) => {
      notification.error({ message: 'Lỗi', description: error.message || 'Có lỗi xảy ra' });
    },
  }, queryClient);
}

function useUpdateDepartment() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentRequest }) => updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({ message: 'Thành công', description: 'Phòng ban đã được cập nhật!' });
    },
    onError: (error: any) => {
      notification.error({ message: 'Lỗi', description: error.message || 'Có lỗi xảy ra' });
    },
  }, queryClient);
}

function useDeleteDepartment() {
  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      notification.success({ message: 'Thành công', description: 'Phòng ban đã được xóa!' });
    },
    onError: (error: any) => {
      notification.error({ message: 'Lỗi', description: error.message || 'Có lỗi xảy ra' });
    },
  }, queryClient);
}

// ============================================
// SECTION 4: MAIN COMPONENTS
// ============================================

// Wrapper component with layout
export function AccountComponent() {
  return (
    <ManagementLayout>
      <AccountManagement />
    </ManagementLayout>
  );
}

// Main management component
export function AccountManagement() {
  const [globalParams, setGlobalParams] = useState(
    () => new URLSearchParams(window.location.search),
  );

  const [params, setParams] = useState({
    ...defaultParams(globalParams),
    role: globalParams.get('role') || '',
    department_name: globalParams.get('department_name') || '',
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');

  const { data: accounts, isLoading: isLoadingAccounts, error: errorAccounts } = useAccounts(params);
  const deleteAccountMutation = useDeleteAccount();

  if (isLoadingAccounts) return <div>Loading...</div>;
  if (errorAccounts) return <div>Error: {errorAccounts.message}</div>;

  const handlePageChange = (page: any, page_size: any) => {
    const filteredParams = new URLSearchParams();
    for (let [key, value] of globalParams.entries()) {
      if (key !== 'page' && key !== 'page_size') {
        filteredParams.set(key, value);
      }
    }

    filteredParams.set('page', page);
    filteredParams.set('page_size', page_size);

    window.location.search = `?${filteredParams}`;
  };

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setModalType('add');
    setModalVisible(true);
  };

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setModalType('edit');
    setModalVisible(true);
  };

  const handleDeleteAccount = (id: string) => {
    deleteAccountMutation.mutate(id, {
      onSuccess: () => {
        // Refresh handled by React Query
      }
    });
  };

  const handleSearch = () => {
    const newParams = {
      ...params,
      page: 1,
      page_size: Number(globalParams.get('page_size')) || 10
    };

    setParams(newParams);

    const filteredParams = new URLSearchParams();
    Object.entries(newParams).forEach(([key, val]) => {
      if (val) filteredParams.set(key, val.toString());
    });
    window.location.search = `?${filteredParams}`;
  };

  // Role badge colors
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'AGENT': return 'blue';
      case 'CUSTOMER': return 'green';
      default: return 'default';
    }
  };

  // Role labels
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Quản trị viên';
      case 'AGENT': return 'Nhân viên';
      case 'CUSTOMER': return 'Khách hàng';
      default: return role;
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Tên đăng nhập',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || '-',
    },
    {
      title: 'Họ tên',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (full_name: string) => full_name || '-',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>{getRoleLabel(role)}</Tag>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (dept: string) => dept || '-',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: Account) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => handleEditAccount(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa"
            description="Bạn có chắc chắn muốn xóa tài khoản này?"
            onConfirm={() => handleDeleteAccount(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className='w-full space-y-4'>
        {/* Filter Bar */}
        <div className='flex gap-2 items-center'>
          <Select
            allowClear
            placeholder="Vai trò"
            style={{ width: 150 }}
            value={params.role || undefined}
            onChange={(value) => setParams({ ...params, role: value })}
            options={[
              { value: 'ADMIN', label: 'Quản trị viên' },
              { value: 'AGENT', label: 'Nhân viên' },
              { value: 'CUSTOMER', label: 'Khách hàng' },
            ]}
          />
          <Input
            placeholder="Phòng ban..."
            style={{ width: 150 }}
            value={params.department_name}
            onChange={(e) => setParams({ ...params, department_name: e.target.value })}
          />
          <Button onClick={handleSearch}>
            Tìm kiếm
          </Button>
        </div>

        {/* Actions Bar */}
        <div className='flex justify-between items-center'>
          <Button type="primary" onClick={handleAddAccount}>
            Thêm tài khoản
          </Button>
        </div>

        {/* Data Table */}
        <Table
          columns={columns}
          dataSource={accounts?.data?.content || accounts?.data}
          rowKey="id"
          pagination={{
            current: accounts?.data?.page_number || 1,
            pageSize: accounts?.data?.page_size || 10,
            total: accounts?.data?.total_elements || 0,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
            showQuickJumper: true,
            showTotal: (total: any, range: any) =>
              `${range[0]}-${range[1]} trong ${total} mục`,
            onChange: handlePageChange,
            onShowSizeChange: handlePageChange,
          }}
          loading={isLoadingAccounts}
        />

        {/* Account Modal */}
        <AccountModal
          type={modalType}
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          selectedAccount={selectedAccount}
        />
      </div>
    </>
  );
}

// Modal component for create/edit
function AccountModal(props: {
  type: 'add' | 'edit';
  visible: boolean;
  onCancel: () => void;
  selectedAccount: Account | null;
}) {
  const [form] = Form.useForm();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  // --- [NEW] Department CRUD States ---
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState<string>("");
  const [isAddingDept, setIsAddingDept] = useState<boolean>(false);
  const [newDeptName, setNewDeptName] = useState<string>("");

  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const { data: departments, isLoading: isLoadingDepartments, refetch: refetchDepartments } = useDepartments();

  // --- [NEW] Department Mutations ---
  const createDeptMutation = useCreateDepartment();
  const updateDeptMutation = useUpdateDepartment();
  const deleteDeptMutation = useDeleteDepartment();

  // Set form values when editing
  React.useEffect(() => {
    if (props.selectedAccount) {
      form.setFieldsValue({
        username: props.selectedAccount.username,
        email: props.selectedAccount.email,
        role: props.selectedAccount.role,
      });
      setSelectedDepartmentId(props.selectedAccount.department_id || null);
    } else {
      form.resetFields();
      setSelectedDepartmentId(null);
    }
    // Reset department edit states
    setEditingDeptId(null);
    setIsAddingDept(false);
    setNewDeptName("");
  }, [props.selectedAccount, form, props.visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (props.type === 'add') {
        const data: CreateAccountRequest = {
          username: values.username,
          password: values.password,
          email: values.email,
          role: values.role,
          department_id: selectedDepartmentId || undefined,
        };

        logger.info(data)

        await createAccountMutation.mutateAsync(data, {
          onSuccess: () => props.onCancel()
        });
      }

      if (props.type === 'edit' && props.selectedAccount) {
        const data: UpdateAccountRequest = {
          username: values.username,
          email: values.email,
          role: values.role,
          department_id: selectedDepartmentId || undefined,
        };

        // Only include password if provided
        if (values.password) {
          data.password = values.password;
        }

        await updateAccountMutation.mutateAsync(
          { id: props.selectedAccount.id, data },
          { onSuccess: () => props.onCancel() }
        );
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // --- [NEW] Department CRUD Handlers ---
  const handleAddDept = async () => {
    if (!newDeptName.trim()) return;

    await createDeptMutation.mutateAsync(
      { name: newDeptName.trim() },
      {
        onSuccess: () => {
          setIsAddingDept(false);
          setNewDeptName("");
          refetchDepartments();
        }
      }
    );
  };

  const handleUpdateDept = async (id: string) => {
    if (!editingDeptName.trim()) {
      setEditingDeptId(null);
      return;
    }

    await updateDeptMutation.mutateAsync(
      { id, data: { name: editingDeptName.trim() } },
      {
        onSuccess: () => {
          setEditingDeptId(null);
          setEditingDeptName("");
          refetchDepartments();
        }
      }
    );
  };

  const handleDeleteDept = async (id: string) => {
    await deleteDeptMutation.mutateAsync(id, {
      onSuccess: () => {
        // Clear selection if deleted department was selected
        if (selectedDepartmentId === id) {
          setSelectedDepartmentId(null);
        }
        refetchDepartments();
      }
    });
  };

  const startEditingDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setEditingDeptName(dept.name);
  };

  const getModalTitle = () => {
    return props.type === 'add' ? 'Thêm tài khoản mới' : 'Chỉnh sửa tài khoản';
  };

  // --- [NEW] Custom Department Columns with CRUD ---
  const departmentColumns = [
    {
      title: 'Chọn',
      key: 'select',
      width: 60,
      render: (_: any, record: Department) => (
        <input
          type="radio"
          name="department"
          checked={selectedDepartmentId === record.id}
          onChange={() => setSelectedDepartmentId(record.id)}
        />
      ),
    },
    {
      title: 'Tên phòng ban',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Department) => {
        if (editingDeptId === record.id) {
          return (
            <Input
              size="small"
              value={editingDeptName}
              onChange={(e) => setEditingDeptName(e.target.value)}
              onPressEnter={() => handleUpdateDept(record.id)}
              onBlur={() => handleUpdateDept(record.id)}
              autoFocus
            />
          );
        }
        return (
          <span
            onClick={() => startEditingDept(record)}
            style={{ cursor: 'pointer' }}
            className="hover:text-blue-600"
          >
            {name}
          </span>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: Department) => (
        <Popconfirm
          title="Xác nhận xóa"
          description={`Xóa phòng ban "${record.name}"?`}
          onConfirm={() => handleDeleteDept(record.id)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<CloseOutlined />}
          />
        </Popconfirm>
      ),
    },
  ];

  const deptList = departments?.data?.content || departments?.data || [];

  return (
    <Modal
      title={getModalTitle()}
      open={props.visible}
      onCancel={props.onCancel}
      footer={[
        <Button key="cancel" onClick={props.onCancel}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createAccountMutation.isPending || updateAccountMutation.isPending}
          onClick={handleSubmit}
        >
          {props.type === 'add' ? 'Thêm' : 'Cập nhật'}
        </Button>,
      ]}
      width={700}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          role: 'CUSTOMER',
        }}
      >
        <Form.Item
          name="username"
          label="Tên đăng nhập"
          rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
        >
          <Input placeholder="Nhập tên đăng nhập" disabled={props.type === 'edit'} />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[
            { required: props.type === 'add', message: 'Vui lòng nhập mật khẩu!' }
          ]}
          extra={props.type === 'edit' ? 'Để trống nếu không muốn thay đổi mật khẩu' : undefined}
        >
          <Input.Password placeholder="Nhập mật khẩu" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
        >
          <Input placeholder="Nhập email" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Vai trò"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
        >
          <Select
            placeholder="Chọn vai trò"
            options={[
              { value: 'ADMIN', label: 'Quản trị viên' },
              { value: 'AGENT', label: 'Nhân viên' },
              { value: 'CUSTOMER', label: 'Khách hàng' },
            ]}
          />
        </Form.Item>

        {/* --- [NEW] Phòng ban with Inline CRUD --- */}
        <Form.Item label="Phòng ban">
          <div className="space-y-2">
            {/* Add Department Button */}
            {!isAddingDept ? (
              <Button
                type="dashed"
                onClick={() => setIsAddingDept(true)}
                icon={<PlusOutlined />}
                block
              >
                Thêm phòng ban
              </Button>
            ) : (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="Nhập tên phòng ban"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  onPressEnter={handleAddDept}
                  autoFocus
                />
                <Button type="primary" onClick={handleAddDept}>
                  Thêm
                </Button>
                <Button onClick={() => { setIsAddingDept(false); setNewDeptName(""); }}>
                  Hủy
                </Button>
              </Space.Compact>
            )}

            {/* Department List */}
            {isLoadingDepartments ? (
              <div>Đang tải...</div>
            ) : (
              <Table
                columns={departmentColumns}
                dataSource={deptList}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
                locale={{ emptyText: 'Chưa có phòng ban nào' }}
              />
            )}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
