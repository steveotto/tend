import type { FinanceGoalTemplate, FinanceGoalTemplateGroup } from '../domain/finance-goal-templates.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

export function FinanceGoalLibraryDialog({
  groups,
  onCreateOwn,
  onChooseTemplate,
  onClose
}: {
  groups: readonly FinanceGoalTemplateGroup[];
  onCreateOwn: () => void;
  onChooseTemplate: (template: FinanceGoalTemplate) => void;
  onClose: () => void;
}) {
  return (
    <MoneyGoalDialog
      title="Add a goal"
      intro="Create a balance goal or customize an optional idea. Nothing is saved until you confirm it."
      closeLabel="Close goal library"
      closeButtonId="finance-goal-library-close"
      initialFocusId="finance-goal-library-close"
      dialogClassName="finance-goal-fullscreen-dialog"
      phoneFullScreen
      onClose={onClose}
    >
      <div className="finance-goal-library">
        <article className="finance-goal-library__create">
          <div>
            <h3>Create your own</h3>
            <p>Choose a savings increase or debt reduction balance goal.</p>
          </div>
          <button type="button" className="btn mini ghost" onClick={onCreateOwn}>Create</button>
        </article>

        {groups.map(group => (
          <section className="finance-goal-library__group" key={group.id} aria-labelledby={`finance-goal-group-${group.id}`}>
            <header>
              <h3 id={`finance-goal-group-${group.id}`}>{group.title}</h3>
              <p>
                <a href={group.sourceUrl} target="_blank" rel="noreferrer">{group.sourceLabel}</a>
                <span> · Optional prompts, not financial advice or an endorsement.</span>
              </p>
            </header>
            <div className="finance-goal-library__templates">
              {group.templates.map(template => (
                <article className="finance-goal-library__template" key={template.id}>
                  <div>
                    <h4>{template.title}</h4>
                    <p>{template.description}</p>
                  </div>
                  <button
                    type="button"
                    className="btn mini ghost"
                    aria-label={`Customize ${template.title}`}
                    onClick={() => onChooseTemplate(template)}
                  >
                    Customize
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
        <p className="finance-goal-library__limit">
          Goals in this preview track one currency balance. Ongoing contributions, spending limits, and giving flows need a different goal model.
        </p>
      </div>
    </MoneyGoalDialog>
  );
}
