import { GoogleAuth } from "@/components/auth/google-auth"

export default function HomePage() {
  // For preview/development: showing system directly without auth
  // To re-enable auth, uncomment the line below and comment out AppLayout
  return <GoogleAuth />

  // const mockUser = {
  //   uid: "preview-user",
  //   email: "preview@studyfocus.ai",
  //   displayName: "Preview User",
  //   photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=preview",
  // }

  // return <AppLayout user={mockUser} onLogout={() => console.log("Logout clicked")} />
}
