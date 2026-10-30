package com.codeit.careeros;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.web.servlet.MvcResult;

public final class TestSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private TestSupport() {
    }

    public static String token(MvcResult result, String field) throws Exception {
        JsonNode body = OBJECT_MAPPER.readTree(result.getResponse().getContentAsString());
        return body.path("data").path(field).asText();
    }

    public static String indent(JsonNode node) {
        return node.toPrettyString();
    }
}