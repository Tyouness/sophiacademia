"use client";

import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";

type RequestActionsProps = {
  requestId: string;
  status: string;
  actionUrl?: string;
};

export default function RequestActions({
  requestId,
  status,
  actionUrl = "/api/staff/requests",
}: RequestActionsProps) {
  const router = useRouter();

  async function send(
    action: "approve" | "reject" | "share_coords" | "detach",
  ) {
    await fetch(actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId }),
    });
    router.refresh();
  }

  if (status !== "pending" && status !== "coords_sent" && status !== "approved") {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" ? (
        <ConfirmDialog
          title="Envoyer les coordonnees"
          description="Le prof recevra les coordonnees de la famille."
          triggerLabel="Envoyer coordonnees"
          confirmLabel="Envoyer"
          onConfirm={() => send("share_coords")}
        />
      ) : status === "coords_sent" ? (
        <ConfirmDialog
          title="Valider la demande"
          description="La demande passera en statut approuve."
          triggerLabel="Approuver"
          confirmLabel="Confirmer"
          onConfirm={() => send("approve")}
        />
      ) : (
        <ConfirmDialog
          title="Dissocier la famille"
          description="La famille et le professeur ne seront plus associes."
          triggerLabel="Dissocier"
          confirmLabel="Confirmer"
          variant="danger"
          onConfirm={() => send("detach")}
        />
      )}
      {(status === "pending" || status === "coords_sent") && (
        <ConfirmDialog
          title="Refuser la demande"
          description="La demande passera en statut refuse."
          triggerLabel="Refuser"
          confirmLabel="Refuser"
          variant="danger"
          onConfirm={() => send("reject")}
        />
      )}
    </div>
  );
}
