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
    "/api/sources/:path*",
    "/api/stats/:path*",
    "/api/usage/:path*",
    "/api/sync-progress/:path*",
    "/api/debug/:path*",
  ],
};
