export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/sources/:path*", "/api/sources/:path*"],
};
