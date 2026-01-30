import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sources/:path*",
    "/api/v1/sources/:path*",
    "/api/v1/stats/:path*",
    "/api/v1/usage/:path*",
    "/api/v1/sync-progress/:path*",
    "/api/v1/debug/:path*",
  ],
};
