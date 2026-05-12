const { evaluatePolicy } = require("../policies/authorization.policy");

function authorize(action, resource) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated",
      });
    }

    try {
      const result = await evaluatePolicy({ action, resource, req });
      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
          code: "AUTHORIZATION_DENIED",
          detail: result.reason,
        });
      }

      req.authorization = {
        ...(req.authorization || {}),
        action,
        resource,
        context: result.context || {},
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  authorize,
};
