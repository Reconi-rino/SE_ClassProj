import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CampusActivitiesPage from "../pages/Public/CampusActivitiesPage";
import { changeRegistration, listMyRegistrations, listOpenActivities, markCancellationRead } from "../services/activityRegistrationApi";
import { fetchPublicTenants } from "../services/tenantApi";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, token: "student-token", loading: false }),
}));

jest.mock("../services/activityRegistrationApi", () => ({
  changeRegistration: jest.fn(),
  listMyRegistrations: jest.fn(),
  listOpenActivities: jest.fn(),
  markCancellationRead: jest.fn(),
}));

jest.mock("../services/tenantApi", () => ({ fetchPublicTenants: jest.fn() }));

test("a student can register, open the personal list and cancel", async () => {
  const activity = {
    id: 28,
    title: "迎新活动",
    club: { id: 7, name: "志愿者协会" },
    start_time: new Date(Date.now() + 86400000).toISOString(),
    registration_capacity: 1,
    status: "approved",
  };
  let registered = false;
  fetchPublicTenants.mockResolvedValue({ data: [{ code: "default", name: "本校" }] });
  listOpenActivities.mockImplementation(async () => ({
    data: [{ ...activity, remaining_places: registered ? 0 : 1 }],
  }));
  listMyRegistrations.mockImplementation(async () => ({
    data: registered ? [{ activity_id: activity.id, activity }] : [],
  }));
  changeRegistration.mockImplementation(async ({ cancel }) => {
    registered = !cancel;
  });
  render(
    <MemoryRouter initialEntries={["/activities"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/activities" element={<CampusActivitiesPage />} />
        <Route path="/my-registrations" element={<CampusActivitiesPage mine />} />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("button", { name: "报名参加" }));
  fireEvent.click(await screen.findByRole("link", { name: "已报名 · 查看记录" }));
  fireEvent.click(await screen.findByRole("button", { name: "取消报名" }));
  expect(await screen.findByText("你还没有报名活动。")).toBeInTheDocument();
  expect(changeRegistration).toHaveBeenLastCalledWith({
    id: 28, tenantCode: "default", token: "student-token", cancel: true,
  });
});

test("a student can read a cancellation notice while keeping the registration record", async () => {
  fetchPublicTenants.mockResolvedValue({ data: [] });
  listMyRegistrations.mockResolvedValue({ data: [{
    activity_id: 14, cancellation_read_at: null,
    activity: {
      id: 14, title: "参观活动", club: { id: 2, name: "博物社" }, status: "cancelled",
      start_time: new Date().toISOString(), cancellation_reason: "场馆暂停开放",
    },
  }] });
  markCancellationRead.mockResolvedValue({ data: { cancellation_read_at: new Date().toISOString() } });
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CampusActivitiesPage mine />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "标记活动取消通知已读：参观活动" }));
  expect(await screen.findByRole("link", { name: "我的报名", exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "活动取消通知" })).not.toBeInTheDocument();
  expect(screen.getByText("取消原因：场馆暂停开放")).toBeInTheDocument();
});
