import UserInviteForm from "@/components/UserInviteForm";

export default function AdminUsersNewPage() {
  return (
    <main className="space-y-6">
      <UserInviteForm
        actionUrl="/api/admin/users/create"
        allowedRoles={["staff", "family", "professor", "admin"]}
        title="Inviter un utilisateur"
        description="Les invitations envoient un lien pour definir le mot de passe."
      />
    </main>
  );
}
