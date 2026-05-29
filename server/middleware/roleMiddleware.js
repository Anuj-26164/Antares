/**
 * Role-based access control middleware factory.
 * Returns Express middleware that checks req.user.role against allowed roles.
 *
 * @param {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 */
export function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    next();
  };
}
