import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReimbursementsPage from "../pages/Finance/ReimbursementsPage";
import { listReimbursements, saveReimbursement } from "../services/reimbursementApi";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ token: "reviewer-token", user: { id: 5 } }),
}));
jest.mock("../services/reimbursementApi", () => ({
  listReimbursements: jest.fn(),
  saveReimbursement: jest.fn(),
}));

test("reviewers approve pending claims and record payment in a separate step", async () => {
  const claim = {
    id: 8, applicant_id: 9, club: { name: "摄影社" }, applicant: { username: "会长" },
    amount: "50", category: "印刷", purpose: "校园摄影展", expense_date: "2026-10-20",
    receipt_reference: "R-123", status: "pending", revision: 1,
  };
  listReimbursements.mockImplementation(async ({ scope, status }) => ({
    data: { can_review: true, clubs: [], requests: scope === "review" && status === claim.status ? [{ ...claim }] : [] },
  }));
  saveReimbursement.mockImplementation(async ({ action, body }) => {
    claim.status = action === "review" ? "approved" : "booked";
    claim.revision += 1;
    if (action === "book") {
      claim.payment_reference = body.payment_reference;
      claim.financial_record = { id: 37 };
    }
  });
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ReimbursementsPage />
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("button", { name: "审核与入账" }));
  fireEvent.click(await screen.findByRole("button", { name: "通过审核" }));
  fireEvent.click(screen.getByRole("button", { name: "确认通过" }));
  await screen.findByText("审核已通过，等待登记付款。");
  fireEvent.change(screen.getByLabelText("状态"), { target: { value: "approved" } });
  fireEvent.click(await screen.findByRole("button", { name: "登记付款" }));
  const book = screen.getByRole("button", { name: "确认已付款并入账" });
  expect(book).toBeDisabled();
  fireEvent.change(screen.getByLabelText("付款凭证编号"), { target: { value: "PAY-33" } });
  fireEvent.click(book);
  await screen.findByText("付款已登记，支出流水已生成。");
  expect(saveReimbursement).toHaveBeenLastCalledWith(expect.objectContaining({
    id: 8, action: "book", body: { payment_reference: "PAY-33", revision: 2 },
  }));
  fireEvent.change(screen.getByLabelText("状态"), { target: { value: "booked" } });
  expect(await screen.findByRole("link", { name: "支出流水 #37" })).toBeInTheDocument();
});

test("a club manager can edit a returned claim using the original application", async () => {
  const claim = {
    id: 9, club_id: 12, applicant_id: 5, club: { name: "摄影社" }, applicant: { username: "会长" },
    amount: "50", category: "印刷", purpose: "海报", expense_date: "2026-10-20",
    receipt_reference: "R-123", status: "returned", revision: 2, review_note: "请注明活动名称",
  };
  listReimbursements.mockResolvedValue({
    data: { can_review: false, clubs: [{ id: 12, name: "摄影社" }], requests: [claim] },
  });
  saveReimbursement.mockResolvedValue({});
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ReimbursementsPage />
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("button", { name: "修改申请" }));
  expect(screen.getByText("退回原因：请注明活动名称")).toBeInTheDocument();
  expect(screen.getByLabelText("发票号或收据编号")).toHaveValue("R-123");
  fireEvent.change(screen.getByLabelText("报销用途"), { target: { value: "校园摄影展海报" } });
  fireEvent.click(screen.getByRole("button", { name: "重新提交" }));
  await screen.findByText("申请已提交，等待审核。");
  expect(saveReimbursement).toHaveBeenLastCalledWith(expect.objectContaining({
    id: 9, action: "resubmit", body: expect.objectContaining({ purpose: "校园摄影展海报", revision: 2 }),
  }));
});

test("a retry of a new application reuses its submission key", async () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(window, "crypto");
  Object.defineProperty(window, "crypto", { configurable: true, value: jest.requireActual("crypto").webcrypto });
  try {
    listReimbursements.mockResolvedValue({
      data: { can_review: false, clubs: [{ id: 12, name: "摄影社" }], requests: [] },
    });
    saveReimbursement.mockReset().mockRejectedValueOnce(new Error("连接暂时中断")).mockResolvedValueOnce({});
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReimbursementsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole("button", { name: "发起报销" }));
    const fields = {
      "金额（元）": "30.25", "支出日期": "2026-11-01", "费用分类": "印刷",
      "发票号或收据编号": "INV-30", "报销用途": "摄影展海报",
    };
    Object.entries(fields).forEach(([label, value]) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    );
    fireEvent.click(screen.getByRole("button", { name: "提交审核" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "提交审核" }));
    await screen.findByText("申请已提交，等待审核。");
    const [first, retry] = saveReimbursement.mock.calls.map(([call]) => call.body);
    expect(first.request_key).toMatch(/^[a-f0-9]{32}$/);
    expect(retry).toEqual(first);
  } finally {
    if (originalCrypto) Object.defineProperty(window, "crypto", originalCrypto);
    else Reflect.deleteProperty(window, "crypto");
  }
});
