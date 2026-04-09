import React, { useState, useEffect } from 'react';
import { PUBLIC_API_BASE_URL } from "@/constants/constant.ts";
import {
  Input,
  Button,
  Form,
  Card,
  notification,
  Spin,
} from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/app/auth/authStore';
import { queryClient, useMutation, useQuery } from "@/lib/ReactQuery";

interface Account {
  id: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  department_id?: string;
  created_at: string;
}

interface UpdateAccountRequest {
  username?: string | null;
  password?: string | null;
  email?: string | null;
  role?: 'ADMIN' | 'AGENT' | 'CUSTOMER' | null;
  department_id?: string | null;
}

async function fetchAccountById(id: string) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/account/${id}`);
  if (!response.ok) throw new Error("Lỗi khi tải thông tin tài khoản");
  const data = await response.json();
  return data;
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

export function Settings() {
  const [form] = Form.useForm();
  const { payload } = useAuthStore();
  const userId = payload?.user_id;

  const { data: account, isLoading, error, refetch } = useQuery(
    {
      queryKey: ["account", userId],
      queryFn: () => fetchAccountById(userId),
      enabled: !!userId,
    },
    queryClient
  );

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: () => {
      notification.success({
        message: 'Thành công',
        description: 'Thông tin tài khoản đã được cập nhật!',
      });
      refetch();
    },
    onError: (error: any) => {
      notification.error({
        message: 'Lỗi',
        description: error.message || 'Có lỗi xảy ra khi cập nhật tài khoản',
      });
    },
  }, queryClient);

  useEffect(() => {
    if (account?.data) {
      form.setFieldsValue({
        username: account.data.username,
        email: account.data.email || '',
      });
    }
  }, [account, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const data: UpdateAccountRequest = {
        username: values.username,
        email: values.email || null,
        role: account?.data?.role || 'CUSTOMER',
        department_id: account?.data?.department_id || null,
      };

      if (values.password) {
        data.password = values.password;
      }

      await updateMutation.mutateAsync(
        { id: userId, data }
      );
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Lỗi khi tải thông tin: {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card
        title="Cài đặt tài khoản"
        className="shadow-lg"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Tên đăng nhập"
              disabled
              className="bg-gray-50"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { type: 'email', message: 'Email không hợp lệ!' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu mới"
            extra="Để trống nếu không muốn thay đổi mật khẩu"
            rules={[
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu mới"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateMutation.isPending}
              block
              size="large"
            >
              Lưu thay đổi
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
