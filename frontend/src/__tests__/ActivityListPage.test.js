import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActivityListPage from "../pages/Activities/ActivityListPage";
import { listActivities } from "../services/businessApi";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    token: "token-1",
  }),
}));

jest.mock("../services/tenantStore", () => ({
  getTenantCode: () => "tenant-a",
}));

jest.mock("../services/businessApi", () => ({
  listActivities: jest.fn(),
}));

describe("ActivityListPage", () => {
  beforeEach(() => {
    listActivities.mockReset();
  });

  it("loads and renders activities", async () => {
    listActivities.mockResolvedValue({
      data: [{ id: 7, title: "迎新宣讲会", status: "approved", start_time: "2026-01-01 09:00" }],
    });
    render(
      <MemoryRouter>
        <ActivityListPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在加载活动列表...");
    expect(await screen.findByText("迎新宣讲会")).toBeInTheDocument();
    expect(listActivities).toHaveBeenCalled();
  });

  it("applies filters when clicking 筛选", async () => {
    listActivities.mockResolvedValue({ data: [] });
    render(
      <MemoryRouter>
        <ActivityListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue("全部状态"), { target: { value: "approved" } });
    fireEvent.change(screen.getByPlaceholderText("社团ID"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));

    await waitFor(() => expect(listActivities).toHaveBeenLastCalledWith(expect.objectContaining({ status: "approved", clubId: "12" })));
  });

  it("shows consistent error message when request fails", async () => {
    listActivities.mockRejectedValue(new Error("网络异常，请稍后重试"));
    render(
      <MemoryRouter>
        <ActivityListPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("网络异常，请稍后重试");
  });
});
