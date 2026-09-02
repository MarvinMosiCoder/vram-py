class Seeder:
    """Base class for every seeder.

    A subclass declares `order`, an optional `description`, and a `run(db)`
    that inserts its rows. Two rules the runner depends on:

      1. **run() must be idempotent.** Seeders are re-run constantly during
         development, so every one of them checks for its rows before
         inserting. Re-running a seeded database must be a no-op, never a
         duplicate-key error.
      2. **run() commits its own work.** The runner does not commit for you,
         because a seeder that writes two related tables decides for itself
         where the transaction boundary goes.

    Report what happened through self.created() / self.skipped() rather than
    print(); the runner collects those and prints one summary per seeder.
    """

    #: Lower runs first. Leave gaps -- 10, 20, 30 -- so a seeder can be
    #: slotted between two existing ones without renumbering anything.
    order: int = 100

    #: Shown by `python seed.py --list`.
    description: str = ""

    def __init__(self):
        self._created: list[str] = []
        self._skipped: list[str] = []

    # -- what a subclass calls --------------------------------------------
    def created(self, label: str) -> None:
        self._created.append(label)

    def skipped(self, label: str) -> None:
        self._skipped.append(label)

    def run(self, db) -> None:
        raise NotImplementedError

    # -- what the runner reads --------------------------------------------
    @property
    def summary(self) -> str:
        if not self._created and not self._skipped:
            return "nothing to do"
        parts = []
        if self._created:
            parts.append("created %d (%s)" % (len(self._created), ", ".join(self._created)))
        if self._skipped:
            parts.append("%d already present" % len(self._skipped))
        return "; ".join(parts)
