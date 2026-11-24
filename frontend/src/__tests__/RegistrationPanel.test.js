import { fireEvent, render, screen } from "@testing-library/react";
import RegistrationPanel from "../pages/Activities/RegistrationPanel";
import { listRegistrationRoster, setRegistrationAttendance } from "../services/activityRegistrationApi";

jest.mock("../services/activityRegistrationApi", () => ({
  listRegistrationRoster: jest.fn(),
  setRegistrationAttendance: jest.fn(),
}));

test("the organizer records attendance and sees the actual headcount", async () => {
  const now = new Date().toISOString();
  listRegistrationRoster.mockResolvedValue({
    data: [{ user: { id: 3, username: "小陈", student_id: "12345678901" }, created_at: now, checked_in_at: null }],
  });
  setRegistrationAttendance.mockResolvedValue({ data: { checked_in_at: now } });
  render(<RegistrationPanel activity={{ id: 4, status: "approved", start_time: now, registration_capacity: 2 }}
    token="president-token" tenantCode="default" />);
  fireEvent.click(screen.getByRole("button", { name: "查看报名名单" }));
  fireEvent.click(await screen.findByRole("button", { name: "签到：小陈" }));
  expect(await screen.findByText("已报名 1 人 · 已签到 1 人")).toBeInTheDocument();
  expect(setRegistrationAttendance).toHaveBeenCalledWith({
    id: 4, userId: 3, checkedIn: true, token: "president-token", tenantCode: "default",
  });
});
