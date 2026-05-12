const express = require("express");
const { body, param, query } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireTenantContext } = require("../middleware/tenant.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const clubController = require("../controllers/clubController");

const router = express.Router();

const clubIdParamValidator = param("id").isInt({ min: 1 }).withMessage("club id must be a positive integer");
const memberIdParamValidator = param("memberId")
  .isInt({ min: 1 })
  .withMessage("member id must be a positive integer");

router.use(requireAuth, requireTenantContext);

router.get(
  "/",
  [
    query("status").optional().isIn(["active", "inactive", "archived"]),
    query("q").optional().isString().isLength({ min: 1, max: 150 }),
  ],
  authorize("read", "club"),
  clubController.listClubs
);

router.get("/:id", [clubIdParamValidator], authorize("read", "club"), clubController.getClub);

router.post(
  "/",
  [
    body("name").isString().trim().isLength({ min: 2, max: 150 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("founder_id").optional().isInt({ min: 1 }),
    body("status").optional().isIn(["active", "inactive", "archived"]),
  ],
  authorize("create", "club"),
  clubController.createClub
);

router.patch(
  "/:id",
  [
    clubIdParamValidator,
    body().custom((value) => {
      const hasField =
        Object.prototype.hasOwnProperty.call(value, "name") ||
        Object.prototype.hasOwnProperty.call(value, "description") ||
        Object.prototype.hasOwnProperty.call(value, "status");
      if (!hasField) {
        throw new Error("At least one field is required: name, description, status");
      }
      return true;
    }),
    body("name").optional().isString().trim().isLength({ min: 2, max: 150 }),
    body("description").optional({ nullable: true }).isString().isLength({ max: 5000 }),
    body("status").optional().isIn(["active", "inactive", "archived"]),
  ],
  authorize("update", "club"),
  clubController.updateClub
);

router.delete("/:id", [clubIdParamValidator], authorize("delete", "club"), clubController.deleteClub);

router.get(
  "/:id/members",
  [clubIdParamValidator],
  authorize("read", "club_member"),
  clubController.listClubMembers
);

router.post(
  "/:id/members/join",
  [clubIdParamValidator],
  authorize("join", "club_member"),
  clubController.joinClub
);

router.post(
  "/:id/members/leave",
  [clubIdParamValidator],
  authorize("leave", "club_member"),
  clubController.leaveClub
);

router.patch(
  "/:id/members/:memberId/role",
  [clubIdParamValidator, memberIdParamValidator, body("role").isIn(["admin", "member"])],
  authorize("update_role", "club_member"),
  clubController.updateClubMemberRole
);

router.delete(
  "/:id/members/:memberId",
  [clubIdParamValidator, memberIdParamValidator],
  authorize("remove", "club_member"),
  clubController.removeClubMember
);

module.exports = router;
