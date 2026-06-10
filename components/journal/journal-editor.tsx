import { Card } from "../ui/card";
import { Button } from "../ui/button";

export function JournalEditor() {
  return (
    <Card className="p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-poppins font-semibold text-dark-text">Today's Journal</h3>
        <span className="text-xs font-poppins text-dark-text/60">What's on your mind?</span>
      </div>
      <textarea
        className="w-full min-h-[160px] p-4 bg-light-gray border border-transparent rounded-xl font-inter text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue resize-none"
        placeholder="Write your thoughts here... or start typing in Taglish!"
      />
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            😔 Coping
          </Button>
          <Button variant="secondary" size="sm">
            😌 Okay
          </Button>
        </div>
        <Button size="sm">
          Save Entry →
        </Button>
      </div>
    </Card>
  );
}
