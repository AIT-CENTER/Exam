"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { StandardModal } from "@/components/standard-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * ModalDemo: Example component showcasing different modal use cases
 * - Simple info modal
 * - Form modal
 * - Confirmation modal
 */
export function ModalDemo() {
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Info Modal */}
      <Button onClick={() => setInfoModalOpen(true)} variant="outline">
        Open Info Modal
      </Button>
      <StandardModal
        open={infoModalOpen}
        onOpenChange={setInfoModalOpen}
        title="Information"
        description="This is a simple information modal"
        size="md"
      >
        <p className="text-sm text-foreground">
          This modal demonstrates smooth fade-in and slide-up animations. It's perfectly centered on the screen and
          works responsively across all device sizes.
        </p>
      </StandardModal>

      {/* Form Modal */}
      <Button onClick={() => setFormModalOpen(true)} variant="outline">
        Open Form Modal
      </Button>
      <StandardModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        title="User Information"
        description="Please fill in your details"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setFormModalOpen(false)}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Enter your name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
        </div>
      </StandardModal>

      {/* Confirmation Modal */}
      <Button onClick={() => setConfirmModalOpen(true)} variant="outline">
        Open Confirmation Modal
      </Button>
      <StandardModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setConfirmModalOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">This action cannot be undone. Please confirm your intention.</p>
      </StandardModal>
    </div>
  )
}
