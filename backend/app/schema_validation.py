from typing import Any


class JsonSchemaValidationError(ValueError):
    pass


def _type_matches(value: Any, expected_type: str) -> bool:
    if expected_type == "object":
        return isinstance(value, dict)
    if expected_type == "array":
        return isinstance(value, list)
    if expected_type == "string":
        return isinstance(value, str)
    if expected_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected_type == "number":
        return (isinstance(value, int | float) and not isinstance(value, bool))
    if expected_type == "boolean":
        return isinstance(value, bool)
    if expected_type == "null":
        return value is None
    return True


def _resolve_ref(schema: dict[str, Any], root_schema: dict[str, Any]) -> dict[str, Any]:
    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return schema
    if not ref.startswith("#/"):
        raise JsonSchemaValidationError(f"Unsupported JSON schema ref {ref!r}.")

    target: Any = root_schema
    for part in ref.removeprefix("#/").split("/"):
        if not isinstance(target, dict) or part not in target:
            raise JsonSchemaValidationError(f"Unresolvable JSON schema ref {ref!r}.")
        target = target[part]
    if not isinstance(target, dict):
        raise JsonSchemaValidationError(f"JSON schema ref {ref!r} does not target an object.")
    return target


def validate_json_schema_output(
    value: Any,
    schema: dict[str, Any],
    *,
    path: str = "$",
    root_schema: dict[str, Any] | None = None,
) -> None:
    root = root_schema or schema
    schema = _resolve_ref(schema, root)

    if "const" in schema and value != schema["const"]:
        raise JsonSchemaValidationError(f"{path} must equal {schema['const']!r}.")

    enum_values = schema.get("enum")
    if isinstance(enum_values, list) and value not in enum_values:
        raise JsonSchemaValidationError(f"{path} must be one of {enum_values!r}.")

    for combinator in ("anyOf", "oneOf"):
        variants = schema.get(combinator)
        if isinstance(variants, list):
            errors: list[str] = []
            matches = 0
            for variant in variants:
                if not isinstance(variant, dict):
                    continue
                try:
                    validate_json_schema_output(
                        value,
                        variant,
                        path=path,
                        root_schema=root,
                    )
                    matches += 1
                except JsonSchemaValidationError as error:
                    errors.append(str(error))
            if combinator == "anyOf" and matches < 1:
                raise JsonSchemaValidationError(
                    f"{path} does not match any allowed schema: {'; '.join(errors)}",
                )
            if combinator == "oneOf" and matches != 1:
                raise JsonSchemaValidationError(
                    f"{path} must match exactly one allowed schema; matched {matches}.",
                )
            return

    all_of = schema.get("allOf")
    if isinstance(all_of, list):
        for variant in all_of:
            if isinstance(variant, dict):
                validate_json_schema_output(value, variant, path=path, root_schema=root)

    expected_type = schema.get("type")
    if isinstance(expected_type, list):
        if not any(_type_matches(value, item) for item in expected_type if isinstance(item, str)):
            raise JsonSchemaValidationError(f"{path} has the wrong JSON type.")
    elif isinstance(expected_type, str) and not _type_matches(value, expected_type):
        raise JsonSchemaValidationError(f"{path} must be {expected_type}.")

    if isinstance(value, dict):
        required = schema.get("required")
        if isinstance(required, list):
            for key in required:
                if isinstance(key, str) and key not in value:
                    raise JsonSchemaValidationError(f"{path}.{key} is required.")

        properties = schema.get("properties")
        if isinstance(properties, dict):
            for key, nested_schema in properties.items():
                if key in value and isinstance(nested_schema, dict):
                    validate_json_schema_output(
                        value[key],
                        nested_schema,
                        path=f"{path}.{key}",
                        root_schema=root,
                    )

        additional = schema.get("additionalProperties")
        if additional is False and isinstance(properties, dict):
            extra = sorted(set(value) - set(properties))
            if extra:
                raise JsonSchemaValidationError(f"{path} has unexpected keys: {extra!r}.")
        elif isinstance(additional, dict):
            known = set(properties) if isinstance(properties, dict) else set()
            for key, nested_value in value.items():
                if key not in known:
                    validate_json_schema_output(
                        nested_value,
                        additional,
                        path=f"{path}.{key}",
                        root_schema=root,
                    )

    if isinstance(value, list):
        min_items = schema.get("minItems")
        max_items = schema.get("maxItems")
        if isinstance(min_items, int) and len(value) < min_items:
            raise JsonSchemaValidationError(f"{path} must contain at least {min_items} items.")
        if isinstance(max_items, int) and len(value) > max_items:
            raise JsonSchemaValidationError(f"{path} must contain at most {max_items} items.")

        items_schema = schema.get("items")
        if isinstance(items_schema, dict):
            for index, item in enumerate(value):
                validate_json_schema_output(
                    item,
                    items_schema,
                    path=f"{path}[{index}]",
                    root_schema=root,
                )

    if isinstance(value, str):
        min_length = schema.get("minLength")
        max_length = schema.get("maxLength")
        if isinstance(min_length, int) and len(value) < min_length:
            raise JsonSchemaValidationError(f"{path} is shorter than {min_length} characters.")
        if isinstance(max_length, int) and len(value) > max_length:
            raise JsonSchemaValidationError(f"{path} is longer than {max_length} characters.")

    if isinstance(value, int | float) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if isinstance(minimum, int | float) and value < minimum:
            raise JsonSchemaValidationError(f"{path} must be at least {minimum}.")
        if isinstance(maximum, int | float) and value > maximum:
            raise JsonSchemaValidationError(f"{path} must be at most {maximum}.")
