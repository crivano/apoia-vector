import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Parse allowed emails from environment variable
const getAllowedEmails = (): string[] => {
  const emails = process.env.ALLOWED_EMAILS || "";
  return emails.split(",").map(email => email.trim()).filter(Boolean);
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = getAllowedEmails();
      
      // If no allowed emails configured, deny access
      if (allowedEmails.length === 0) {
        console.error("ALLOWED_EMAILS not configured");
        return false;
      }
      
      // Check if user email is in allowed list
      if (user.email && allowedEmails.includes(user.email)) {
        return true;
      }
      
      console.warn(`Access denied for email: ${user.email}`);
      return false;
    },
    async session({ session, token }) {
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
