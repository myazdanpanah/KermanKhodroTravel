"""
Workflow serializers — validation for definition builder payloads.

The frontend sends a whole workflow definition (states + transitions) in one
request; these serializers validate the shape before the views persist it.
"""

from rest_framework import serializers

from .models import WorkflowState


class WorkflowStateInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    state_type = serializers.ChoiceField(
        choices=[choice[0] for choice in WorkflowState.STATE_TYPES],
        default="normal",
    )
    required_role = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    order = serializers.IntegerField(required=False, default=0)


class WorkflowTransitionInputSerializer(serializers.Serializer):
    source = serializers.CharField(max_length=100)
    target = serializers.CharField(max_length=100)
    action = serializers.CharField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    requires_comment = serializers.BooleanField(required=False, default=False)
    auto_execute = serializers.BooleanField(required=False, default=False)


class WorkflowDefinitionCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    document_type = serializers.CharField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    version = serializers.IntegerField(required=False, min_value=1)
    is_active = serializers.BooleanField(required=False, default=True)
    states = WorkflowStateInputSerializer(many=True)
    transitions = WorkflowTransitionInputSerializer(many=True, required=False, default=list)

    def validate_states(self, states):
        names = [state["name"].strip() for state in states]
        if not names:
            raise serializers.ValidationError("At least one state is required.")
        if len(names) != len(set(names)):
            raise serializers.ValidationError("State names must be unique.")
        if not any(state["state_type"] == "start" for state in states):
            raise serializers.ValidationError("At least one state must have type 'start'.")
        return states

    def validate(self, attrs):
        state_names = {state["name"].strip() for state in attrs["states"]}
        seen = set()
        for transition in attrs.get("transitions", []):
            source = transition["source"].strip()
            target = transition["target"].strip()
            if source not in state_names or target not in state_names:
                raise serializers.ValidationError(
                    f"Transition '{source}' → '{target}' references an unknown state."
                )
            key = (source, transition["action"].strip())
            if key in seen:
                raise serializers.ValidationError(
                    f"Duplicate transition action '{transition['action']}' from state '{source}'."
                )
            seen.add(key)
        return attrs


class WorkflowDefinitionUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
