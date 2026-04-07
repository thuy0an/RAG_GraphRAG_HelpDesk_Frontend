import {
  Space,
  Button,
  Tag,
} from "antd";

const statusColor: Record<string, string> = {
  OPEN: "blue",
  IN_PROGRESS: "gold",
  RESOLVED: "green",
  CLOSED: "default",
};

const priorityColor: Record<string, string> = {
  LOW: "green",
  MEDIUM: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const priorityLabel: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

const statusLabel: Record<string, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  CLOSED: "Đã đóng",
};

export const ticketColumns = (props: any) => [
  {
    title: "Mã ticket",
    dataIndex: "id",
    key: "id",
    sorter: (a: any, b: any) => a.id?.localeCompare(b.id),
  },
  {
    title: "Tiêu đề",
    dataIndex: "subject",
    key: "subject"
  },
  {
    title: "Danh mục",
    dataIndex: "category",
    key: "category",
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    render: (value: string) => (
      <Tag color={statusColor[value] || "default"}>{statusLabel[value] || value}</Tag>
    ),
  },
  {
    title: "Mức độ ưu tiên",
    dataIndex: "priority",
    key: "priority",
    render: (value: string) => (
      <Tag color={priorityColor[value] || "default"}>{priorityLabel[value] || value}</Tag>
    ),
  },
  {
    title: "Thao tác",
    key: "actions",
    fixed: "right",
    render: (_: any, record: any) => (
      <Space>
        <Button
          onClick={() => {
            props.setSelectedTicket(record);
            props.setModalType('view');
            props.setModalVisible(true);
            console.log("View ticket:", record);
          }}
        >
          Xem
        </Button>

        <Button
          type="link"
          onClick={() => {
            props.setSelectedTicket(record);
            props.setModalType('edit');
            props.setModalVisible(true);
            console.log("Edit ticket:", record);
          }}
        >
          Cập nhật
        </Button>
        
        {/* <Popconfirm
          title="Xóa sản phẩm?"
          description="Bạn có chắc muốn xóa sản phẩm này?"
          okText="Xóa"
          cancelText="Hủy"
          onConfirm={async () => {
            console.log("Delete ticket:", record.id);
            await props.deleteTicketMutation.mutateAsync(
              { id: record.id },
              {
                onSuccess: (data: any) => {
                  notification.success({
                    description: data.message,
                  });

                  setTimeout(() => {
                    if (props.tickets?.data.content.length === 1 && props.params.page > 1) {
                      const prevPage = props.params.page - 1;
                      const newParams = new URLSearchParams(window.location.search);
                      newParams.set('page', prevPage.toString());
                      window.location.search = `?${newParams.toString()}`;
                    }
                  }, 500)
                }
              }
            );
          }}
        >
          <Button type="link" danger>
            Xóa
          </Button>
        </Popconfirm> */}
        
      </Space>
    ),
  },
];

export const departmentColumns = () => [
  {
    title: "Tên phòng ban",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "Email",
    dataIndex: "email",
    key: "email",
  }
]