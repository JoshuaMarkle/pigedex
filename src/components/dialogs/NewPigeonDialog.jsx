import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// ----- Dialog ----- //

export default function NewPigeonDialog({
  open,
  onOpenChange,
  pigeons,
  onCreate,
}) {
  const defaultForm = {
    name: "",
    birthday: "",
    status: "home",
    bandId: "",
    bandColor: "none",
    parentOneId: "",
    parentTwoId: "",
    notes: "",
  };

  const [form, setForm] = useState(defaultForm);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(defaultForm);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) return;

    const parentIds = [form.parentOneId, form.parentTwoId].filter(Boolean);

    const nextPigeon = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      birthday: form.birthday.trim() || null,
      status: form.status,
      bandId: form.bandId.trim() || null,
      bandColor: form.bandColor || "none",
      parentIds,
      notes: form.notes.trim() || "",
    };

    onCreate(nextPigeon);
    resetForm();
    onOpenChange(false);
  }

  const parentOneOptions = pigeons.filter(
    (pigeon) => pigeon.id !== form.parentTwoId,
  );

  const parentTwoOptions = pigeons.filter(
    (pigeon) => pigeon.id !== form.parentOneId,
  );

  function getPigeonNameById(id) {
    return pigeons.find((pigeon) => pigeon.id === id)?.name || "Unknown";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add new bird</DialogTitle>
          <DialogDescription>
            Add a pigeon to the family graph. Parents are optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Blue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Birthday</Label>

              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.birthday || "Select birthday"}
                    </Button>
                  }
                ></PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.birthday
                        ? new Date(
                            Number(form.birthday.slice(6, 10)),
                            Number(form.birthday.slice(0, 2)) - 1,
                            Number(form.birthday.slice(3, 5)),
                          )
                        : undefined
                    }
                    onSelect={(date) => {
                      updateField(
                        "birthday",
                        date ? format(date, "MM-dd-yyyy") : "",
                      );
                    }}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Parent 1</Label>

              <Select
                value={form.parentOneId || "none"}
                onValueChange={(value) =>
                  updateField("parentOneId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.parentOneId
                      ? getPigeonNameById(form.parentOneId)
                      : "Unknown"}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>

                  {parentOneOptions.map((pigeon) => (
                    <SelectItem key={pigeon.id} value={pigeon.id}>
                      <div className="flex flex-col">
                        <span>{pigeon.name}</span>
                        {pigeon.bandId ? (
                          <span className="text-xs text-muted-foreground">
                            {pigeon.bandId}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Parent 2</Label>

              <Select
                value={form.parentTwoId || "none"}
                onValueChange={(value) =>
                  updateField("parentTwoId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.parentTwoId
                      ? getPigeonNameById(form.parentTwoId)
                      : "Unknown"}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>

                  {parentTwoOptions.map((pigeon) => (
                    <SelectItem key={pigeon.id} value={pigeon.id}>
                      <div className="flex flex-col">
                        <span>{pigeon.name}</span>
                        {pigeon.bandId ? (
                          <span className="text-xs text-muted-foreground">
                            {pigeon.bandId}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-band-id">Band ID</Label>
              <Input
                id="new-band-id"
                value={form.bandId}
                onChange={(event) => updateField("bandId", event.target.value)}
                placeholder="Unknown"
              />
            </div>

            <div className="space-y-2">
              <Label>Band color</Label>
              <Select
                value={form.bandColor}
                onValueChange={(value) => updateField("bandColor", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Band color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => updateField("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="flying">Flying</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-notes">Notes</Label>
            <Textarea
              id="new-notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Random information, medical notes, behavior..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit">Add bird</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
