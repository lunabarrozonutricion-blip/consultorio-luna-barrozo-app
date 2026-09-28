        if (
          anthropometry.id !=
          null
        ) {
          existingAnthropometry =
            await d.fullAnthropometries.get(
              anthropometry.id,
            );
        }

        if (
          !existingAnthropometry
        ) {
          existingAnthropometry =
            await d.fullAnthropometries
              .where(
                "[playerId+date]",
              )
              .equals([
                anthropometry.playerId,
                anthropometry.date,
              ])
              .first();
        }

        const finalRecord:
          FullAnthropometry = {
          ...anthropometry,
          id:
            existingAnthropometry
              ?.id ??
            undefined,
          results,
          linkedControlId:
            controlId,
          createdAt:
            existingAnthropometry
              ?.createdAt ??
            anthropometry.createdAt ??
            timestamp,
          updatedAt:
            timestamp,
        };

        let anthropometryId:
          number;

        let anthropometryIsNew =
          false;

        if (
          existingAnthropometry?.id !=
          null
        ) {
          anthropometryId =
            existingAnthropometry.id;

          await d.fullAnthropometries.put(
            {
              ...finalRecord,
              id:
                anthropometryId,
            },
          );
        } else {
          anthropometryId =
            Number(
              await d.fullAnthropometries.add(
                finalRecord,
              ),
            );

          anthropometryIsNew =
            true;
        }

        return {
          controlId,
          controlIsNew,
          anthropometryId,
          anthropometryIsNew,
        };
      },
    );

  queueUpsertOperation(
    "control",
    result.controlId,
    result.controlIsNew,
  );

  queueUpsertOperation(
    "fullAnthropometry",
    result.anthropometryId,
    result.anthropometryIsNew,
  );

  schedulePendingSync();

  return result.anthropometryId;
}

export async function deleteFullAnthropometry(
  id: number,
) {
  await db()
    .fullAnthropometries
    .delete(id);

  queueDelete(
    "fullAnthropometry",
    id,
  );
}

export async function findFullAnthropometryByDate(
  playerId: number,
  date: string,
) {
  return await db()
    .fullAnthropometries
    .where(
      "[playerId+date]",
    )
    .equals([
      playerId,
      date,
    ])
