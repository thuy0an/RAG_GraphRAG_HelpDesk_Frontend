import { UserPortalChat } from "./UserPortalChat";
import UserHeader from "@/components/UserHeader";

export function UserPortal() {
  return (
    <>
      <UserHeader />
      <div className="p-4 md:p-6">
        <UserPortalChat />
      </div>
    </>
  );
}
