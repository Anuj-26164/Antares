import Button from './Button';

export default function EmptyState({ message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-steel dark:text-ash text-[16px]">{message}</p>
      {action && (
        <div className="mt-6">
          <Button variant="outline" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
