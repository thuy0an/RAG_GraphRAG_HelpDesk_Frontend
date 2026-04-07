import { useState } from "react";
import {
  Button,
  Card,
  Divider,
  Drawer,
  Form,
  Input,
  message,
  Rate,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useAuthStore } from "../../auth/authStore";
import { useCreateUserTicket, useSubmitTicketFeedback, useUserTickets } from "./useUserPortalApi";
import { UserPortalChat } from "./UserPortalChat";
import UserHeader from "@/components/UserHeader";

type TicketRecord = {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  attachment_url?: { url: string }[] | { files: string[] } | string | any;
  satisfaction_rating?: number;
  customer_feedback?: string;
};

const statusColor: Record<string, string> = {
  OPEN: "blue",
  IN_PROGRESS: "gold",
  RESOLVED: "green",
  CLOSED: "default",
  PENDING: "orange",
};

const priorityColor: Record<string, string> = {
  LOW: "green",
  MEDIUM: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const statusLabel: Record<string, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  CLOSED: "Đã đóng",
  PENDING: "Chờ xử lý",
};

export function UserPortal() {
  const [form] = Form.useForm();
  const [feedbackForm] = Form.useForm();
  const { payload } = useAuthStore();

  const [params, setParams] = useState({
    page: 1,
    page_size: 10,
    status: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);

  const { data: ticketResp, isLoading } = useUserTickets(params);
  const createMutation = useCreateUserTicket();
  const submitFeedbackMutation = useSubmitTicketFeedback();

  const tickets = (ticketResp?.data?.content ?? []) as TicketRecord[];
  const total = ticketResp?.data?.total_elements ?? 0;

  const columns = [
    {
      title: "Mã",
      dataIndex: "id",
      key: "id",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Tiêu đề",
      dataIndex: "subject",
      key: "subject",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: string) => (
        <Tag color={statusColor[value] || "default"}>{statusLabel[value] || value}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_: unknown, record: TicketRecord) => (
        <Button type="link" onClick={() => setSelectedTicket(record)}>
          Xem
        </Button>
      ),
    },
  ];

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const ticketPayload = {
        subject: values.subject,
        description: values.description,
        customer_id: payload?.user_id,
      };

      const formData = new FormData();
      formData.append("ticket", JSON.stringify(ticketPayload));
      files.forEach((file) => {
        if (file.originFileObj) {
          formData.append("attachments", file.originFileObj);
        }
      });

      await createMutation.mutateAsync(formData);
      
      message.success("Tạo ticket thành công");
      form.resetFields();
      setFiles([]);
      setCreateOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  const handleCloseTicketDetail = () => {
    setSelectedTicket(null);
    feedbackForm.resetFields();
  };

  const handleSubmitFeedback = async () => {
    if (!selectedTicket) return;

    try {
      const values = await feedbackForm.validateFields();
      await submitFeedbackMutation.mutateAsync({
        ticket_id: selectedTicket.id,
        satisfaction_rating: values.satisfaction_rating,
        customer_feedback: values.customer_feedback,
      });
      message.success("Gửi đánh giá thành công");
      feedbackForm.resetFields();
      handleCloseTicketDetail();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  return (
    <>
      <UserHeader />
      <div className="p-4 md:p-6">
      <Card
        title="Danh sách tickets"
        extra={
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            + Create Ticket
          </Button>
        }
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            allowClear
            placeholder="Trạng thái"
            value={params.status || undefined}
            onChange={(value) => setParams((prev) => ({ ...prev, status: value || "", page: 1 }))}
            style={{ width: 180 }}
            options={[
              { label: "Mở", value: "OPEN" },
              { label: "Đang xử lý", value: "IN_PROGRESS" },
              { label: "Đã giải quyết", value: "RESOLVED" },
              { label: "Đã đóng", value: "CLOSED" },
            ]}
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          loading={isLoading}
          dataSource={tickets}
          pagination={{
            current: params.page,
            pageSize: params.page_size,
            total,
            onChange: (page, page_size) => setParams((prev) => ({ ...prev, page, page_size })),
          }}
        />
      </Card>

      <Drawer
        title="Create Ticket"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={520}
        extra={
          <Space>
            <Button onClick={() => setCreateOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMutation.isPending} onClick={handleCreate}>
              Tạo
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="Tiêu đề" rules={[{ required: true, message: "Nhập tiêu đề" }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item
            name="description"
            label="Mô tả"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Attachments">
            <Upload
              multiple
              beforeUpload={() => false}
              fileList={files}
              onChange={({ fileList }) => setFiles(fileList)}
            >
              <Button>Chọn file</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={selectedTicket ? `Ticket #${selectedTicket.id}` : "Ticket detail"}
        open={!!selectedTicket}
        onClose={handleCloseTicketDetail}
        width={520}
      >
        {selectedTicket && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div>
              <strong>Tiêu đề:</strong> {selectedTicket.subject}
            </div>
            <div>
              <strong>Mô tả:</strong> {selectedTicket.description}
            </div>
            <div>
              <strong>Trạng thái:</strong>{" "}
              <Tag color={statusColor[selectedTicket.status] || "default"}>{selectedTicket.status}</Tag>
            </div>
            {(selectedTicket.attachment_url && (() => {
              const data = typeof selectedTicket.attachment_url === 'string' ? JSON.parse(selectedTicket.attachment_url || '[]') : selectedTicket.attachment_url;
              const urls = Array.isArray(data) ? data.map((a: any) => a.url).filter(Boolean) : data?.files || [];
              return urls.length > 0 && (
                <div>
                  <strong>Attachments:</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {urls.map((url: string, i: number) => (
                      <li key={i}><a href={url} target="_blank">{url.split("/").pop()}</a></li>
                    ))}
                  </ul>
                </div>
              );
            })()) || null}

            {selectedTicket.status === "RESOLVED" && (
              <>
                <Divider />
                {selectedTicket.satisfaction_rating ? (
                  <div>
                    <div>
                      <strong>Đánh giá dịch vụ:</strong>
                      <div style={{ marginTop: 8 }}>
                        <Rate value={selectedTicket.satisfaction_rating} disabled />
                      </div>
                    </div>
                    {selectedTicket.customer_feedback && (
                      <div style={{ marginTop: 12 }}>
                        <strong>Nhận xét:</strong>
                        <p style={{ marginTop: 4, color: "#666" }}>
                          {selectedTicket.customer_feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Form form={feedbackForm} layout="vertical">
                    <Form.Item
                      name="satisfaction_rating"
                      label="Đánh giá dịch vụ"
                      rules={[{ required: true, message: "Vui lòng chọn số sao đánh giá" }]}
                    >
                      <Rate disabled={submitFeedbackMutation.isPending} />
                    </Form.Item>
                    <Form.Item name="customer_feedback" label="Nhận xét">
                      <Input.TextArea
                        rows={3}
                        placeholder="Nhập nhận xét của bạn (không bắt buộc)"
                        disabled={submitFeedbackMutation.isPending}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button
                        type="primary"
                        onClick={handleSubmitFeedback}
                        loading={submitFeedbackMutation.isPending}
                        block
                      >
                        Gửi đánh giá
                      </Button>
                    </Form.Item>
                  </Form>
                )}
              </>
            )}
          </Space>
        )}
      </Drawer>

      <UserPortalChat />
      </div>
    </>
  );
}

